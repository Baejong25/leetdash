class Solution {
    public int solution(int[] array, int height) {
        int result = 0; 
        for (int h: array){
            if (height < h) {
                result += 1; 
            }
        }
        return result; 
    }
}