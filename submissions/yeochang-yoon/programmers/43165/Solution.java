class Solution {
    public int solution(int[] numbers, int target) {

        int answer = plus(numbers, 0, 0, target);
        return answer;
    }

    public int plus(int[] numbers, int sum, int cur, int target){
        if(cur == numbers.length){
            if(sum == target){
                return 1;
            }else{
                return 0;
            }
        }

        return plus(numbers, sum + numbers[cur], cur+1, target) + plus(numbers, sum - numbers[cur], cur+1, target);
    }
}