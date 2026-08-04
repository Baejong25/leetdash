class Solution {
    int num = 0;
    int result = 0;
    char[] arr = {'A', 'E', 'I', 'O', 'U'};

    public int solution(String word) {

        count(word, "");

        return result;
    }

    public void count(String word, String cur){
        if(cur.equals(word)){
            result = num;
            return;
        }
        if(cur.length() == 5){
            return;
        }
        for(int i = 0; i < 5; i++){
            num++;
            count(word, cur + arr[i]);
        }
    }
}