class Solution {
    public List<List<Integer>> generate(int numRows) {
        List<List<Integer>> result = new ArrayList<>();

        List<Integer> one = new ArrayList<>();
        one.add(1);
        result.add(one);

        if(numRows == 1){
            return result;
        }

        List<Integer> two = new ArrayList<>();
        two.add(1);
        two.add(1);
        result.add(two);

        if(numRows == 2){
            return result;
        }

        for(int i = 2; i < numRows; i++){
            List<Integer> now = new ArrayList<>(i+1);
            List<Integer> before = result.get(i-1);

            now.addAll(Collections.nCopies(i+1, 0));
            now.set(0, 1);
            now.set(i, 1);

            for(int j = 1; j < i; j++){
                now.set(j, before.get(j-1) + before.get(j));
            }

            result.add(now);
        }

        return result;

    }
}